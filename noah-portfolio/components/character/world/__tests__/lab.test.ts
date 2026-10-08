import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, stepCharacter } from '@/lib/character/controller';
import { STATION_LINES } from '@/lib/character/narrative';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createLab } from '../lab';
import { lotOrigin } from '../town';
import type { WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const origin = lotOrigin(2);
const withProjects = (projects: WorldContent['projects']): WorldContent => ({ ...real, projects });
const eight = withProjects([...real.projects, ...['alpha', 'beta', 'gamma'].map((name) => ({ ...real.projects[0], slug: `extra-${name}`, title: `Extra ${name}` }))]);
const longTitle = 'An Extraordinarily Long Story Model Benchmark Title That Keeps On Going';

type Load = { url: string; texture: THREE.Texture<HTMLImageElement>; onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void; onError?: (error: unknown) => void };
let loads: Load[];
type Draw = { canvas: HTMLCanvasElement; text: string; left: number; right: number; top: number; bottom: number };
let draws: Draw[];

beforeEach(() => {
  loads = []; draws = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    loads.push({ url, texture, onLoad, onError });
    return texture;
  });
  // Records every line of text with a font-aware width so overflow is measurable.
  stubCanvas2d().mockImplementation(function (this: HTMLCanvasElement) {
    const state: Record<string | symbol, unknown> = { font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' };
    const size = () => Number(/([\d.]+)px/.exec(String(state.font))?.[1] ?? 10);
    const measure = (text: string) => text.length * size() * .6;
    const fillText = (text: string, x: number, y: number) => {
      const width = measure(text), height = size();
      const left = state.textAlign === 'center' ? x - width / 2 : state.textAlign === 'right' || state.textAlign === 'end' ? x - width : x;
      const top = state.textBaseline === 'middle' ? y - height / 2 : state.textBaseline === 'top' ? y : y - height * .8;
      draws.push({ canvas: this, text, left, right: left + width, top, bottom: top + height });
    };
    return new Proxy(state, {
      get: (target, key) => key in target ? target[key] : key === 'measureText' ? (text: string) => ({ width: measure(text) }) : key === 'fillText' ? fillText : () => ({ addColorStop() {} }),
      set: (target, key, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => vi.restoreAllMocks());

const ids = (content: WorldContent) => [...content.projects.map((project) => `project:${project.slug}`), 'skills'];
const flat = (point: { x: number; z: number }) => new THREE.Vector2(point.x, point.z);

describe('createLab', () => {
  it.each([0, 1, 5])('has one play station per project plus the skills wall for %i projects', (count) => {
    const content = withProjects(real.projects.slice(0, count));
    const area = createLab(origin, content);
    expect(area.id).toBe('workshop');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations.map((station) => station.id)).toEqual(ids(content));
    expect(area.stations.map((station) => station.kind)).toEqual([...content.projects.map(() => 'play'), 'tinker']);
    for (const station of area.stations) expect(station.label.length).toBeGreaterThan(3);
  });

  it.each([
    ['no', withProjects([])], ['one', withProjects(real.projects.slice(0, 1))], ['the real', real], ['eight', eight],
  ])('lays out %s projects inside the extents with reachable, unobstructed stations', (_, content) => {
    const area = createLab(origin, content);
    const { bounds, obstacles } = area;
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);

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
    }
    for (const [index, a] of area.stations.entries()) for (const b of area.stations.slice(index + 1)) expect(flat(a.stand).distanceTo(flat(b.stand))).toBeGreaterThan(.5);

    expect(inset(area.entry) && clear(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .6);
    for (const station of area.stations) {
      const state = createCharacterState({ ...area.entry });
      for (let frame = 0; frame < 1800; frame++) stepCharacter(state, station.stand, 1 / 60, obstacles, bounds);
      expect(Math.hypot(state.position.x - station.stand.x, state.position.z - station.stand.z), station.id).toBeLessThan(.13);
    }

    const exhibits = content.projects.map((project) => new THREE.Box3().setFromObject(area.group.getObjectByName(`project:${project.slug}`)!).translate(origin.clone().negate()));
    for (const [index, exhibit] of exhibits.entries()) {
      expect([exhibit.min.x >= bounds.minX, exhibit.max.x <= bounds.maxX, exhibit.min.z >= bounds.minZ, exhibit.max.z <= bounds.maxZ]).toEqual([true, true, true, true]);
      for (const other of exhibits.slice(index + 1)) expect(exhibit.intersectsBox(other)).toBe(false);
    }

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(120);
    expect(triangles).toBeLessThanOrEqual(25000);
  });

  it('lets every exhibit present its project: its own lines, and a Visit link only when the project has a url', () => {
    const area = createLab(origin, withProjects([...real.projects, { ...real.projects[0], slug: 'no-link', title: 'No Link', url: '' }]));
    for (const project of real.projects) {
      const station = area.stations.find((entry) => entry.id === `project:${project.slug}`)!;
      expect(station.present).toEqual({ lines: STATION_LINES[station.id], url: project.url, linkLabel: `Visit ${project.title}` });
      expect(station.present!.lines.length).toBeGreaterThan(0);
    }
    expect(area.stations.find((entry) => entry.id === 'project:no-link')!.present!.url).toBeUndefined();
    expect(area.stations.find((entry) => entry.id === 'skills')!.present).toBeUndefined();
  });

  it('labels every skill, category and project, wrapping long titles inside their label', () => {
    const content = withProjects([...real.projects, { ...real.projects[3], slug: 'long-one', title: longTitle }]);
    createLab(origin, content);
    const phrases = new Set(draws.flatMap((_, index) => [1, 2, 3, 4].map((lines) => draws.slice(index, index + lines).map((draw) => draw.text).join(' '))));
    for (const name of [...content.skills.flatMap((group) => [group.category, ...group.skills.map((skill) => skill.name)]), ...content.projects.map((project) => project.title)]) expect(phrases, name).toContain(name);
    for (const [index, draw] of draws.entries()) {
      expect([draw.left >= 0, draw.right <= draw.canvas.width, draw.top >= 0, draw.bottom <= draw.canvas.height], draw.text).toEqual([true, true, true, true]);
      for (const other of draws.slice(index + 1)) {
        if (other.canvas !== draw.canvas) continue;
        expect(draw.right <= other.left || other.right <= draw.left || draw.bottom <= other.top || other.bottom <= draw.top, `${draw.text} / ${other.text}`).toBe(true);
      }
    }
  });

  it('shows each project image on its screen in sRGB and keeps a plain screen when loading fails', () => {
    const area = createLab(origin, real);
    expect(loads.map((load) => load.url)).toEqual(real.projects.map((project) => project.image));
    const [ok, broken] = loads;
    ok.texture.image = Object.assign(document.createElement('img'), { width: 1600, height: 900 });
    ok.onLoad?.(ok.texture);
    broken.onError?.(new Error('404'));
    const shows = (id: string, texture: THREE.Texture) => {
      let found = false;
      area.group.getObjectByName(id)!.traverse((node) => { if (node instanceof THREE.Mesh && 'map' in node.material && node.material.map === texture) found = true; });
      return found;
    };
    expect(shows(`project:${real.projects[0].slug}`, ok.texture)).toBe(true);
    expect(ok.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(shows(`project:${real.projects[1].slug}`, broken.texture)).toBe(false);
  });

  it('picks the station for every exhibit part and the skills wall, and nothing for floor or walls', () => {
    const area = createLab(origin, real);
    const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
    // Aim from the front at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 5) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().add(new THREE.Vector3(0, .3, 1.3)), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches a part of ${mesh.parent?.name}`);
    };
    for (const id of ids(real)) {
      const parts: THREE.Mesh[] = [];
      area.group.getObjectByName(id)!.traverse((node) => { if (node instanceof THREE.Mesh) parts.push(node); });
      expect(parts.length).toBeGreaterThanOrEqual(3);
      for (const part of parts) expect(area.pick(aim(part)), id).toBe(id);
    }
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
    const floor = ray(local(area.entry.x, 3, area.entry.z), local(area.entry.x, 0, area.entry.z));
    const sideWall = ray(local(0, 3.2, -1.5), local(-10, 3.2, -1.5));
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
    for (let frame = 1; frame <= 45; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / 45 });
  };

  it('animates every exhibit while idle', () => {
    const area = createLab(origin, eight);
    const before = ids(eight).slice(0, -1).map((id) => pose(area.group.getObjectByName(id)!));
    run(area, null);
    ids(eight).slice(0, -1).forEach((id, index) => expect(difference(before[index], pose(area.group.getObjectByName(id)!)), id).toBeGreaterThan(0));
  });

  it.each(ids(eight))('%s reacts visibly while active and nothing else changes', (active) => {
    const idle = createLab(origin, eight), busy = createLab(origin, eight);
    run(idle, null); run(busy, active);
    for (const id of ids(eight)) {
      const change = difference(pose(idle.group.getObjectByName(id)!), pose(busy.group.getObjectByName(id)!));
      if (id === active) expect(change, id).toBeGreaterThan(.03);
      else expect(change, id).toBe(0);
    }
  });

  it('dispose frees every geometry, material and texture it put in the scene, including a texture that loads afterwards', () => {
    const area = createLab(origin, eight);
    const [late, early] = loads;
    early.texture.image = Object.assign(document.createElement('img'), { width: 1600, height: 900 });
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
    late.texture.image = Object.assign(document.createElement('img'), { width: 1600, height: 900 });
    late.onLoad?.(late.texture);

    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
    expect([...owned].filter((item) => item instanceof THREE.CanvasTexture).length).toBe(eight.projects.length + 2);
    let attached = false;
    area.group.traverse((node) => { if (node instanceof THREE.Mesh && 'map' in node.material && node.material.map === late.texture) attached = true; });
    expect(attached).toBe(false);
  });
});
