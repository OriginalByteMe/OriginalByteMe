import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { corpus } from '@/lib/corpus';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import type { WorldArea } from '../types';
import { createAbout } from '../about';

const ORIGIN = new THREE.Vector3(0, -36, 0);
const CAREER = 'content/about-me/career.md';
/** Three jobs out of date order: a third highlight he skips, one without a url and one with a remote logo; fun facts get no station. */
const CONTENT: WorldContent = {
  projects: [], skills: [], funFacts: ["I'm into 3D printing and CAD"],
  headline: 'Full-stack software engineer', location: 'Kuala Lumpur, Malaysia',
  career: [
    { company: 'MerchantSpring', role: 'Senior AI Engineer', period: '2026 - Present', logo: '/logos/merchantspring.svg', url: 'https://merchantspring.io', highlights: ['Building marketplace analytics', 'Full-stack work across the platform', 'Never said'] },
    { company: 'Supa (formerly Supahands)', role: 'Full-Stack Developer', period: '2020 - 2025', logo: '/logos/supa.png', url: '', highlights: ['Built data-labeling tooling.'] },
    { company: 'Elsewhere Ltd', role: 'Intern', period: '2019 - 2020', logo: 'https://example.com/logo.png', url: 'https://example.com', highlights: [] },
  ],
};
const EMPTY: WorldContent = { ...CONTENT, career: [] };

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
const portraitImage = (area: WorldArea) => firstHit(area, straightOn(0, 2.8))!.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
const width = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x;
const meshes = (root: THREE.Object3D) => { const found: THREE.Mesh[] = []; root.traverse((node) => { if (node instanceof THREE.Mesh) found.push(node); }); return found; };
const shown = (node: THREE.Object3D) => { for (let at: THREE.Object3D | null = node; at; at = at.parent) if (!at.visible) return false; return true; };
const root = (area: WorldArea, id: string) => area.group.children.find((child) => child.userData.station === id)!;
/** Everything a visitor sees change under a station: placement, visibility, colours, instance transforms. Hidden meshes count only as hidden. */
const look = (object: THREE.Object3D) => {
  object.updateWorldMatrix(true, true);
  return meshes(object).flatMap((node) => {
    const values = [
      ...node.matrixWorld.elements,
      ...[node.material].flat().flatMap((material) => {
        const { opacity, color, emissive } = material as THREE.MeshStandardMaterial;
        return [opacity, ...(color?.toArray() ?? []), ...(emissive?.toArray() ?? [])];
      }),
      ...(node instanceof THREE.InstancedMesh ? [...node.instanceMatrix.array, ...(node.instanceColor?.array ?? [])] : []),
    ];
    return shown(node) ? [1, ...values] : [0, ...values.fill(0)];
  });
};
const difference = (a: number[], b: number[]) => a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);

describe('createAbout', () => {
  it.each([['three jobs', CONTENT], ['the corpus', worldContent(corpus)], ['no jobs', EMPTY]])('lays out reachable stations, a soft landing and an exit inside the island with %s', (_, content) => {
    const area = build(content);
    const { bounds, landing, exit } = area;
    expect(area.id).toBe('about');
    expect(area.group.position.toArray()).toEqual(ORIGIN.toArray());
    const ids = area.stations.map((station) => station.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(area.stations.find((station) => station.id === 'portrait')?.kind).toBe('admire');
    expect(area.stations.find((station) => station.id === 'skyline')?.kind).toBe('watch');
    expect(ids.filter((id) => id.startsWith('career:'))).toHaveLength(content.career.length);
    expect(ids).toHaveLength(2 + content.career.length);

    // controller.ts clamps the character centre to bounds inset by its .22 radius, so every target must sit inside that.
    const inside = (p: { x: number; z: number }) => p.x >= bounds.minX + .22 && p.x <= bounds.maxX - .22 && p.z >= bounds.minZ + .22 && p.z <= bounds.maxZ - .22;
    const clear = (p: { x: number; z: number }) => area.obstacles.every((obstacle) => Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >= obstacle.radius + .22);
    for (const station of area.stations) {
      const { stand, reach } = station;
      expect(inside(stand) && clear(stand), station.id).toBe(true);
      const ahead = Math.hypot(reach.x - stand.x, reach.z - stand.z);
      expect(ahead, station.id).toBeGreaterThanOrEqual(.3); expect(ahead, station.id).toBeLessThanOrEqual(.9);
      expect(reach.y, station.id).toBeGreaterThanOrEqual(.8); expect(reach.y, station.id).toBeLessThanOrEqual(1.6);
      const facing = Math.atan2(reach.x - stand.x, reach.z - stand.z) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.6);
      // His hands land on the station's own object, not on a wall or a neighbour.
      const reachRay = ray([stand.x, 1.6, stand.z], [reach.x, reach.y, reach.z]);
      expect(area.pick(reachRay), station.id).toBe(station.id);
      expect(firstHit(area, reachRay)!.point.sub(ORIGIN).distanceTo(new THREE.Vector3(reach.x, reach.y, reach.z)), station.id).toBeLessThan(.12);
      for (const other of area.stations) if (other !== station) expect(Math.hypot(stand.x - other.stand.x, stand.z - other.stand.z), `${station.id} vs ${other.id}`).toBeGreaterThan(.6);
    }

    // He falls onto a soft raised surface that is no station, away from every station, and hops off 0.9 forward onto free floor.
    expect(landing.y).toBeGreaterThan(.3);
    const drop = ray([landing.x, landing.y + 1, landing.z], [landing.x, -1, landing.z]);
    expect(firstHit(area, drop)!.point.y - ORIGIN.y).toBeCloseTo(landing.y, 1);
    expect(area.pick(drop)).toBeNull();
    for (const station of area.stations) expect(Math.hypot(landing.x - station.stand.x, landing.z - station.stand.z)).toBeGreaterThan(1.2);
    const hop = { x: landing.x, z: landing.z + .9 };
    expect(inside(hop) && clear(hop)).toBe(true);
    expect(inside(exit) && clear(exit)).toBe(true); expect(exit.z).toBeGreaterThan(bounds.maxZ - .6);

    const box = new THREE.Box3().setFromObject(area.group).translate(ORIGIN.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-9, -3, -6.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [9, 8, 6][axis])).toEqual([true, true, true]);
    expect(bounds.minX).toBeGreaterThan(box.min.x); expect(bounds.maxX).toBeLessThan(box.max.x);
    expect(bounds.minZ).toBeGreaterThan(box.min.z); expect(bounds.maxZ).toBeLessThan(box.max.z);

    let triangles = 0;
    const all = meshes(area.group);
    for (const node of all) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    expect(all.length).toBeLessThanOrEqual(80); expect(triangles).toBeLessThanOrEqual(40_000);
    area.dispose();
  });

  it('walks the career runner left to right from the oldest job, every stop on one line', () => {
    const area = build();
    const stops = area.stations.filter((station) => station.id.startsWith('career:')).sort((a, b) => a.stand.x - b.stand.x);
    expect(stops.map((station) => station.id)).toEqual(['career:elsewhere-ltd', 'career:supa', 'career:merchantspring']);
    for (const stop of stops) expect(stop.stand.z).toBeCloseTo(stops[0].stand.z, 2);
    for (const [index, stop] of stops.entries()) if (index) expect(stop.stand.x - stops[index - 1].stand.x).toBeGreaterThan(1.5);
    area.dispose();
  });

  it('presents each job as role, company and years then up to two highlights, with a Visit link when it has a url', () => {
    const area = build();
    const present = (id: string) => area.stations.find((station) => station.id === id)!.present!;
    expect(present('career:merchantspring').lines.map((line) => line.line)).toEqual([
      'Senior AI Engineer at MerchantSpring, 2026 to now.', 'Building marketplace analytics.', 'Full-stack work across the platform.',
    ]);
    expect(present('career:supa').lines.map((line) => line.line)).toEqual(['Full-Stack Developer at Supa (formerly Supahands), 2020 to 2025.', 'Built data-labeling tooling.']);
    expect(present('career:elsewhere-ltd').lines.map((line) => line.line)).toEqual(['Intern at Elsewhere Ltd, 2019 to 2020.']);
    for (const id of ['career:merchantspring', 'career:supa', 'career:elsewhere-ltd']) {
      const lines = present(id).lines;
      expect(lines.every((line) => line.source === CAREER), id).toBe(true);
      expect(new Set(lines.map((line) => line.id)).size, id).toBe(lines.length);
    }
    expect(present('career:merchantspring')).toMatchObject({ url: 'https://merchantspring.io', linkLabel: 'Visit MerchantSpring' });
    expect(present('career:supa').url).toBeUndefined();
    // The skyline talks about where he lives; the portrait keeps its own admire line instead of a presentation.
    expect(present('skyline').lines.length).toBeGreaterThan(0);
    expect(present('skyline').lines.every((line) => line.source === 'content/about-me/bio.md')).toBe(true);
    expect(area.stations.find((station) => station.id === 'portrait')!.present).toBeUndefined();
    area.dispose();
  });

  it('loads the portrait and each same-origin company logo once, and no remote or protocol-relative logos', () => {
    build().dispose();
    expect(loads.map((load) => load.url).sort()).toEqual(['/hero.png', '/logos/merchantspring.svg', '/logos/supa.png']);
    loads = [];
    build(EMPTY).dispose();
    expect(loads.map((load) => load.url)).toEqual(['/hero.png']);
    loads = [];
    build({ ...EMPTY, career: [{ ...CONTENT.career[2], logo: '//example.com/logo.png' }] }).dispose();
    expect(loads.map((load) => load.url)).toEqual(['/hero.png']);
  });

  it.each([['loads', true], ['fails', false]])('shows the logo on its card when it %s, else keeps the plain card', (_, succeeds) => {
    const area = build();
    const load = loads.find((entry) => entry.url === '/logos/supa.png')!;
    const stop = root(area, 'career:supa');
    const visible = () => meshes(stop).filter(shown);
    const before = visible().length;
    if (succeeds) finish(load, 284, 112); else load.onError?.(new Error('404'));
    expect(visible().length).toBe(before + (succeeds ? 1 : 0));
    expect(visible().filter((node) => (node.material as THREE.MeshBasicMaterial).map === load.texture)).toHaveLength(succeeds ? 1 : 0);
    area.dispose();
  });

  it('picks the station for every visible part of it from the front, and nothing for floor, walls or furniture', () => {
    const area = build();
    // Aim from in front of and above the part at its box centre, else at its vertices, until the ray touches it.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0, .3, 1.3)), new THREE.Vector3(0, -.3, -1.3).normalize());
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches a part of ${mesh.parent?.userData.station}`);
    };
    for (const { id } of area.stations) {
      const parts = meshes(root(area, id)).filter(shown);
      expect(parts.length, id).toBeGreaterThanOrEqual(2);
      for (const part of parts) expect(area.pick(aim(part)), id).toBe(id);
    }
    const { exit, landing } = area;
    for (const raycaster of [
      ray([exit.x, 4, exit.z], [exit.x, -1, exit.z]), ray([0, 4, -1], [0, -1, -1]), straightOn(-3, 4.2), ray([0, 3, -2], [-7, 3, -2]),
      ray([landing.x, landing.y + 1, landing.z], [landing.x, -1, landing.z]),
    ]) {
      expect(firstHit(area, raycaster)).toBeDefined();
      expect(area.pick(raycaster)).toBeNull();
    }
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
    expect(area.pick(straightOn(.85, 2.8))).toBe('portrait');
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

  it.each(['portrait', 'skyline', 'career:elsewhere-ltd', 'career:supa', 'career:merchantspring'])('animates only %s while he presents there, and it settles back once he leaves', (active) => {
    const quiet = build(), busy = build();
    let elapsed = 10;
    const advance = (frames: number, stationId: string | null) => {
      for (let frame = 1; frame <= frames; frame++) {
        elapsed += 1 / 30;
        quiet.update(1 / 30, elapsed, { stationId: null, progress: 0 });
        busy.update(1 / 30, elapsed, { stationId, progress: frame / frames });
      }
    };
    advance(75, active);
    for (const { id } of quiet.stations) {
      const change = difference(look(root(quiet, id)), look(root(busy, id)));
      if (id === active) expect(change, id).toBeGreaterThan(.05); else expect(change, id).toBe(0);
    }
    advance(150, null);
    expect(difference(look(root(quiet, active)), look(root(busy, active)))).toBeLessThan(.02);
    quiet.dispose(); busy.dispose();
  });

  it('disposes every geometry, material and texture it created, including loads that finish after dispose', () => {
    const area = build();
    const owned = new Set<object>();
    const collect = () => area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    collect();
    const hero = loads.find((load) => load.url === '/hero.png')!;
    const logos = loads.filter((load) => load !== hero);
    expect(logos).toHaveLength(2);
    finish(logos[0], 44, 44);
    collect();
    const image = portraitImage(area);
    const dispatch = vi.spyOn(THREE.EventDispatcher.prototype, 'dispatchEvent');
    area.dispose();
    const freed = new Set(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    finish(hero, 1408, 1926);
    finish(logos[1], 284, 112);
    expect([...owned].filter((resource) => !freed.has(resource))).toEqual([]);
    expect(loads.filter((load) => !load.disposed).map((load) => load.url)).toEqual([]);
    expect(image.material.map).not.toBe(hero.texture);
  });
});
